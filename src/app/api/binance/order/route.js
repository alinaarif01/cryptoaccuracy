import { NextResponse } from 'next/server';
import { BinanceAPI } from '../../../../lib/binance';
import { getOpenPositions, saveOpenPositions, getSettings } from '../../../../lib/config';

export const dynamic = 'force-dynamic';
export const preferredRegion = 'fra1'; // Deploy serverless function in Frankfurt, Europe

export async function POST(request) {
  try {
    const body = await request.json();
    const { symbol, side, amountUsdt, orderType = 'MARKET', price = null, takeProfitPercent, stopLossPercent } = body;

    if (!symbol || !side || !amountUsdt) {
      return NextResponse.json({ success: false, error: 'Symbol, side (BUY/SELL), and amount are required.' }, { status: 400 });
    }

    const orderResult = await BinanceAPI.placeOrder({
      symbol,
      side: side.toUpperCase(),
      amountUsdt: parseFloat(amountUsdt),
      orderType: (orderType || 'MARKET').toUpperCase(),
      price: price ? parseFloat(price) : null
    });

    const tp = takeProfitPercent ? parseFloat(takeProfitPercent) : 1.8;
    const sl = stopLossPercent ? parseFloat(stopLossPercent) : 1.0;

    let tpPrice = 0;
    let slPrice = 0;

    if (side.toUpperCase() === 'BUY') {
      tpPrice = parseFloat((orderResult.entryPrice * (1 + tp / 100)).toFixed(4));
      slPrice = parseFloat((orderResult.entryPrice * (1 - sl / 100)).toFixed(4));
    } else {
      tpPrice = parseFloat((orderResult.entryPrice * (1 - tp / 100)).toFixed(4));
      slPrice = parseFloat((orderResult.entryPrice * (1 + sl / 100)).toFixed(4));
    }

    const newPosition = {
      id: `BIN-${orderResult.orderId || Date.now()}`,
      binanceOrderId: orderResult.orderId,
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      entryPrice: orderResult.entryPrice,
      currentPrice: orderResult.entryPrice,
      amountUsdt: orderResult.amountUsdt,
      quantity: orderResult.quantity,
      takeProfitPrice: tpPrice,
      stopLossPrice: slPrice,
      tpPercent: tp,
      slPercent: sl,
      source: 'manual',
      status: 'OPEN',
      openedAt: new Date().toISOString()
    };

    const positions = getOpenPositions();
    positions.unshift(newPosition);
    saveOpenPositions(positions);

    return NextResponse.json({
      success: true,
      message: `Order successfully placed on Binance: ${newPosition.side} ${newPosition.symbol}`,
      position: newPosition,
      positions
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
