"use server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import MachinesClient from "./action";

// Server action (runs on server)
export async function createMachine(formData: FormData) {

  const name = String(formData.get("name") || "").trim();
  const region = String(formData.get("region") || "").trim();
  const url = String(formData.get("url") || "").trim();
  const token = String(formData.get("token") || "").trim();

  if (!name || !region || !url || !token) {
    throw new Error("All fields are required.");
  }

  await prisma.machines.create({
    data: { name, region, url, token },
  });

  // Revalidate this page so the new item appears after the client refresh
  revalidatePath("/machines");
}

export default async function MachinesPage() {
  const machines = await prisma.machines.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, region: true, url: true, token: true },
  });

  return (
  <div>
    <MachinesClient machines={machines} />
  </div>
  );
}