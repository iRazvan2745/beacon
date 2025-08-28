import { NextResponse } from "next/server";
import { runSnapshot, getMachines } from "@/lib/api"

export async function GET() {
  const machines = await getMachines();
  return NextResponse.json(machines);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { machineId } = body;

        if (!machineId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing machineId",
                },
                { status: 400 },
            );
        }

        const result = await runSnapshot(machineId);

        return NextResponse.json({
            success: true,
            result,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Error running snapshot:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
        );
    }
}