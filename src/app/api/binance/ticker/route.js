import { NextResponse } from 'next/server';
import { BinanceAPI } from '../../../../lib/binance';

export const dynamic = 'force-dynamic';
export const preferredRegion = 'fra1';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (symbol) {
      const price = await BinanceAPI.getPrice(symbol);
      const klines = await BinanceAPI.getKlines(symbol, '1d', 2);
      const prevClose = klines.length > 1 ? parseFloat(klines[0][4]) : price;
      const changePercent = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

      return NextResponse.json({
        success: true,
        ticker: {
          symbol: symbol.toUpperCase(),
          price,
          changePercent: parseFloat(changePercent.toFixed(2))
        }
      });
    }

    const popularSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT', 'ADAUSDT', 'AVAXUSDT', 'NEARUSDT', 'LINKUSDT'];
    const tickers = await BinanceAPI.get24hTickers(popularSymbols);
    return NextResponse.json({ success: true, tickers });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
