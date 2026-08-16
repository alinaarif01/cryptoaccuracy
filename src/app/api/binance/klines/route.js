import { NextResponse } from 'next/server';
import { BinanceAPI } from '../../../../lib/binance';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTCUSDT';
    const interval = searchParams.get('interval') || '5m';
    const limit = parseInt(searchParams.get('limit') || '100');

    const klines = await BinanceAPI.getKlines(symbol, interval, limit);
    return NextResponse.json({ success: true, symbol, interval, klines });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
