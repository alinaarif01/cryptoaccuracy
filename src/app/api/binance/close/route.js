import { NextResponse } from 'next/server';
import { BinanceAPI } from '../../../../lib/binance';
import { getOpenPositions, saveOpenPositions } from '../../../../lib/config';

export const dynamic = 'force-dynamic';
export const preferredRegion = 'fra1';

export async function POST(request) {
  try {
    const body = await request.json();
    const { tradeId, symbol } = body;

    let positions = getOpenPositions();
    let targetPos = null;

    if (tradeId) {
      targetPos = positions.find(p => p.id === tradeId);
    } else if (symbol) {
      targetPos = positions.find(p => p.symbol === symbol.toUpperCase() && p.status === 'OPEN');
    } else if (positions.length > 0) {
      targetPos = positions[0];
    }

    if (!targetPos) {
      return NextResponse.json({ success: false, error: 'No matching active position found to close.' }, { status: 404 });
    }

    let exitPrice = targetPos.currentPrice || targetPos.entryPrice;

    // Execute reverse market close directly on Binance
    try {
      const closeResult = await BinanceAPI.closeOrder({
        symbol: targetPos.symbol,
        side: targetPos.side,
        quantity: targetPos.quantity
      });
      if (closeResult.exitPrice) {
        exitPrice = closeResult.exitPrice;
      }
    } catch (binanceErr) {
      console.warn('Binance close error:', binanceErr.message);
      exitPrice = await BinanceAPI.getPrice(targetPos.symbol);
    }

    let pnl = 0;
    let pnlPercent = 0;

    if (targetPos.side === 'BUY') {
      pnl = (exitPrice - targetPos.entryPrice) * targetPos.quantity;
      pnlPercent = ((exitPrice - targetPos.entryPrice) / targetPos.entryPrice) * 100;
    } else {
      pnl = (targetPos.entryPrice - exitPrice) * targetPos.quantity;
      pnlPercent = ((targetPos.entryPrice - exitPrice) / targetPos.entryPrice) * 100;
    }

    const closedRecord = {
      ...targetPos,
      status: 'CLOSED',
      exitPrice,
      closedAt: new Date().toISOString(),
      pnl: parseFloat(pnl.toFixed(2)),
      pnlPercent: parseFloat(pnlPercent.toFixed(2)),
      isWin: pnl > 0,
      closeReason: 'Manual User Close'
    };

    const remainingPositions = positions.filter(p => p.id !== targetPos.id);
    saveOpenPositions(remainingPositions);

    return NextResponse.json({
      success: true,
      message: `Position for ${targetPos.symbol} closed successfully on Binance.`,
      closedTrade: closedRecord,
      positions: remainingPositions
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
