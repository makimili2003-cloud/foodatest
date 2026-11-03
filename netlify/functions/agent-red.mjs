// Zakazana obrada reda FoodAR agenta, svakog minuta.
import { processQueue } from '../lib/agent.mjs';

export default async () => {
  const res = await processQueue();
  return new Response(JSON.stringify(res), { headers: { 'Content-Type': 'application/json' } });
};

export const config = { schedule: '* * * * *' };
