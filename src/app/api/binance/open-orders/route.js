import { NextResponse } from 'next/server';
import { BinanceAPI } from '../../../../lib/binance';

export const dynamic = 'force-dynamic';
export const preferredRegion = 'fra1';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || null;

    // DIRECT BINANCE SIGNED API CALL
    const openOrders = await BinanceAPI.getOpenOrders(symbol);
    return NextResponse.json({ success: true, count: openOrders.length, orders: openOrders });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
