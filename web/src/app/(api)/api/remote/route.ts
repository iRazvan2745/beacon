import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { machineId, data } = body;

    if (!machineId || !data) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing machineId or data",
        },
        { status: 400 },
      );
    }

    await prisma.machines.update({
      where: { id: machineId },
      data: {
        stats: {
          ...data,
          lastReported: new Date().toISOString(),
          machineId,
        },
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Stats updated successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error storing stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get("machineId");

    if (machineId) {
      const machine = await prisma.machines.findUnique({
        where: { id: machineId },
        select: {
          id: true,
          name: true,
          region: true,
          stats: true,
          updatedAt: true,
        },
      });

      if (!machine) {
        return NextResponse.json(
          {
            success: false,
            error: "Machine not found",
          },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        machine: {
          ...machine,
          stats: machine.stats || null,
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      const machines = await prisma.machines.findMany({
        select: {
          id: true,
          name: true,
          region: true,
          stats: true,
          updatedAt: true,
        },
        orderBy: { name: "asc" },
      });

      return NextResponse.json({
        success: true,
        machines: machines.map((machine) => ({
          ...machine,
          stats: machine.stats || null,
        })),
        count: machines.length,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Error retrieving stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
