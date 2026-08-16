import { NextResponse } from 'next/server';
import { BinanceAPI } from '../../../../lib/binance';

export const dynamic = 'force-dynamic';
export const preferredRegion = 'fra1';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTCUSDT';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // DIRECT BINANCE SIGNED API CALL FOR HISTORICAL TRADES
    const allOrders = await BinanceAPI.getAllOrders(symbol, limit);
    return NextResponse.json({ success: true, count: allOrders.length, orders: allOrders });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
