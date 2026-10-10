import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: string;
    employeeId: number;
    gender: string;
    employeeType: string;
  }
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      role: string;
      employeeId: number;
      gender: string;
      employeeType: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    employeeId: number;
    gender: string;
    employeeType: string;
  }
}
