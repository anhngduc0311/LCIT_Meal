import { Role } from "./roles";

export type User = {
  id: number;
  fullName: string;
  username: string;
  status: string;
  createdAt: string;
  createdBy: number;
  updatedAt: string;
  updatedBy: number;
  roles: Role[];
};

// Sample data dump: 12 users
export const sampleUsers: User[] = [
  {
    id: 1,
    fullName: "Nguyễn Văn A",
    username: "a.nguyen@example.com",
    status: "active",
    createdAt: "2026-01-12",
    createdBy: 1,
    updatedAt: "2026-01-12",
    updatedBy: 1,
    roles: [],
  },
  {
    id: 2,
    fullName: "Trần Thị B",
    username: "b.tran@example.com",
    status: "active",
    createdAt: "2026-02-03",
    createdBy: 1,
    updatedAt: "2026-02-03",
    updatedBy: 1,
    roles: [],
  },
  {
    id: 3,
    fullName: "Lê Văn C",
    username: "c.le@example.com",
    status: "inactive",
    createdAt: "2026-02-20",
    createdBy: 1,
    updatedAt: "2026-02-20",
    updatedBy: 1,
    roles: [],
  },
  {
    id: 4,
    fullName: "Phạm Thị D",
    username: "d.pham@example.com",
    status: "active",
    createdAt: "2026-03-05",
    createdBy: 1,
    updatedAt: "2026-03-05",
    updatedBy: 1,
    roles: [],
  },
  {
    id: 5,
    fullName: "Hoàng Văn E",
    username: "e.hoang@example.com",
    status: "active",
    createdAt: "2026-03-21",
    createdBy: 1,
    updatedAt: "2026-03-21",
    updatedBy: 1,
    roles: [],
  },
  {
    id: 6,
    fullName: "Vũ Thị F",
    username: "f.vu@example.com",
    status: "inactive",
    createdAt: "2026-04-01",
    createdBy: 1,
    updatedAt: "2026-04-01",
    updatedBy: 1,
    roles: [],
  },
  {
    id: 7,
    fullName: "Đặng Văn G",
    username: "g.dang@example.com",
    status: "active",
    createdAt: "2026-04-15",
    createdBy: 1,
    updatedAt: "2026-04-15",
    updatedBy: 1,
    roles: [],
  },
  {
    id: 8,
    fullName: "Bùi Thị H",
    username: "h.bui@example.com",
    status: "active",
    createdAt: "2026-05-02",
    createdBy: 1,
    updatedAt: "2026-05-02",
    updatedBy: 1,
    roles: [],
  },
  {
    id: 9,
    fullName: "Trịnh Văn I",
    username: "i.trinh@example.com",
    status: "active",
    createdAt: "2026-05-18",
    createdBy: 1,
    updatedAt: "2026-05-18",
    updatedBy: 1,
    roles: [],
  },
  {
    id: 10,
    fullName: "Ngô Thị J",
    username: "j.ngo@example.com",
    status: "inactive",
    createdAt: "2026-06-04",
    createdBy: 1,
    updatedAt: "2026-06-04",
    updatedBy: 1,
    roles: [],
  },
  {
    id: 11,
    fullName: "Phan Văn K",
    username: "k.phan@example.com",
    status: "active",
    createdAt: "2026-06-20",
    createdBy: 1,
    updatedAt: "2026-06-20",
    updatedBy: 1,
    roles: [],
  },
  {
    id: 12,
    fullName: "Lý Thị L",
    username: "l.ly@example.com",
    status: "active",
    createdAt: "2026-07-08",
    createdBy: 1,
    updatedAt: "2026-07-08",
    updatedBy: 1,
    roles: [],
  },
];
