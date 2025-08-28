export async function sendStats({
  machineId,
  data,
}: {
  machineId: string;
  data: any;
}) {
  const res = await fetch(`${process.env.APP_URL}/api/remote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      machineId,
      data,
    }),
  });
  if (!res.ok) throw new Error("Failed to send stats");
  return await res.json();
}