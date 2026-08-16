import { NextResponse } from 'next/server';
import { BinanceAPI } from '../../../../lib/binance';

export const dynamic = 'force-dynamic';
export const preferredRegion = 'fra1'; // Deploy serverless function in Frankfurt, Europe

export async function GET() {
  try {
    const accountInfo = await BinanceAPI.getAccountBalance();
    return NextResponse.json({ success: true, ...accountInfo });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
