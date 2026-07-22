import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const result = await sql`SELECT NOW() as current_time`;
    return NextResponse.json({ success: true, time: result[0].current_time });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}