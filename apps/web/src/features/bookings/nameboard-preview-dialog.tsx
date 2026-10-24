import { getBaseUrl } from '@cockpit/shared/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** Bare filename extension check — good enough here: the only two kinds
 * NameboardUploadDialog accepts (`accept="image/*,.pdf"`) are images and
 * PDFs, so this only ever has to tell those two apart. */
function isPdf(url: string): boolean {
  return url.toLowerCase().endsWith('.pdf')
}

/**
 * Shows the nameboard already on file in a popup instead of a new browser
 * tab — the link next to the Nameboard field opens this rather than
 * `trip.nameboardUrl` directly.
 */
export function NameboardPreviewDialog({
  url,
  onOpenChange,
}: {
  /** The trip's `nameboardUrl` (relative path) — null closes the dialog. */
  url: string | null
  onOpenChange: (open: boolean) => void
}) {
  const fullUrl = url ? `${getBaseUrl()}${url}` : null

  return (
    <Dialog open={!!url} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nameboard</DialogTitle>
        </DialogHeader>
        {fullUrl &&
          (isPdf(fullUrl) ? (
            <iframe src={fullUrl} title="Nameboard PDF" className="h-[70vh] w-full rounded-md border" />
          ) : (
            <img src={fullUrl} alt="Nameboard" className="max-h-[70vh] w-full rounded-md border object-contain" />
          ))}
      </DialogContent>
    </Dialog>
  )
}
