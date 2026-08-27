import { useState, type ChangeEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { TripEntity } from '@cockpit/shared/api'
import {
  ApiError,
  getBaseUrl,
  getTripsControllerListQueryKey,
  getTripsControllerUploadNameboardUrl,
} from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Kept in sync with apps/api/src/trips/nameboard-upload.config.ts (fileSize limit).
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Multipart upload isn't a good fit for the orval/react-query codegen (see the
// comment on TripsController.uploadNameboard) — a plain fetch against the same
// endpoint/base URL the generated client uses, rather than a generated hook.
async function uploadNameboard(ref: string, file: File): Promise<TripEntity> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`${getBaseUrl()}${getTripsControllerUploadNameboardUrl(ref)}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  const body = await response.json().catch(() => undefined)
  if (!response.ok) throw new ApiError(response.status, body)
  return body as TripEntity
}

export function NameboardUploadDialog({
  trip,
  onOpenChange,
}: {
  trip: TripEntity | null
  onOpenChange: (open: boolean) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const upload = useMutation({
    mutationFn: (f: File) => uploadNameboard(trip?.ref ?? '', f),
  })

  const close = (open: boolean) => {
    if (!open) setFile(null)
    onOpenChange(open)
  }

  const confirm = async () => {
    if (!trip || !file) return
    try {
      await upload.mutateAsync(file)
      toast.success(`Nameboard uploaded for trip ${trip.ref}.`)
      void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
      close(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error uploading the nameboard.'))
    }
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null
    if (picked && picked.size > MAX_FILE_SIZE) {
      toast.error('File too large (10MB max).')
      event.target.value = ''
      setFile(null)
      return
    }
    setFile(picked)
  }

  return (
    <Dialog open={!!trip} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload nameboard{trip ? ` — ${trip.ref}` : ''}</DialogTitle>
        </DialogHeader>
        {trip && (
          <div className="grid gap-4">
            {trip.nameboardUrl && (
              <a
                href={`${getBaseUrl()}${trip.nameboardUrl}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary text-sm underline"
              >
                View current nameboard
              </a>
            )}
            <div className="grid gap-2">
              <Label htmlFor="nameboard-file">File (image or PDF, 10MB max)</Label>
              <Input id="nameboard-file" type="file" accept="image/*,.pdf" onChange={onFileChange} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Close
          </Button>
          <Button type="button" disabled={!file || upload.isPending} onClick={() => void confirm()}>
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
