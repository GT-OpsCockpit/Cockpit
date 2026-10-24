export class ClientContactEntity {
  id: string;
  clientId: string;
  name: string;
  phone: string | null;
  email: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}
