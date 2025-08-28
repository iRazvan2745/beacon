"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createMachine } from "./page";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EllipsisVertical } from "lucide-react";

type Machine = {
  id: string;
  name: string;
  region: string;
  url: string;
  token: string;
};

export default function MachinesClient({ machines }: { machines: Machine[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setErr(null);
    startTransition(async () => {
      try {
        await createMachine(formData);
        setOpen(false);
        // Refresh data quickly
        router.refresh();
      } catch (e: any) {
        setErr(e?.message || "Failed to create machine");
      }
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Machines</h1>
          <p className="text-sm text-muted-foreground">
            Manage your machines.
          </p>
        </div>

        <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
          <DialogTrigger asChild>
            <Button>Add machine</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add machine</DialogTitle>
            </DialogHeader>

            <form action={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="prod-api-1"
                  required
                  disabled={pending}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  name="region"
                  placeholder="us-east-1"
                  required
                  disabled={pending}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  name="url"
                  type="url"
                  placeholder="https://example.com"
                  required
                  disabled={pending}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="token">Token</Label>
                <Input
                  id="token"
                  name="token"
                  type="password"
                  placeholder="secret token"
                  required
                  disabled={pending}
                />
              </div>

              {err ? (
                <p className="text-sm text-red-600">{err}</p>
              ) : null}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[240px]">ID</TableHead>
              <TableHead className="">Name</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {machines.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-sm text-muted-foreground"
                >
                  No machines found.
                </TableCell>
              </TableRow>
            ) : (
              machines.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.id}</TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.region}</TableCell>
                  <TableCell>
                    <a
                      href={m.url}
                      className="text-primary underline underline-offset-4"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {m.url}
                    </a>
                  </TableCell>
                  <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                        <EllipsisVertical className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => console.log("View clicked")}>
                        Configure
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => console.log("Delete clicked")}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}