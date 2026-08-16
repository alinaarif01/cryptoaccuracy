import { NextResponse } from 'next/server';
import { BinanceAPI } from '../../../../lib/binance';
import { analyzeCandles } from '../../../../lib/indicators';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTCUSDT';
    const interval = searchParams.get('interval') || '5m';

    const klines = await BinanceAPI.getKlines(symbol, interval, 60);
    const analysis = analyzeCandles(klines);

    return NextResponse.json({ success: true, symbol, interval, analysis });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
