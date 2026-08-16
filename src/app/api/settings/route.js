import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '../../../lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = getSettings();
    return NextResponse.json({
      success: true,
      settings: {
        ...settings,
        apiKey: settings.apiKey ? settings.apiKey.slice(0, 6) + '...' + settings.apiKey.slice(-4) : '',
        apiSecret: settings.apiSecret ? '••••••••' + settings.apiSecret.slice(-4) : ''
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const current = getSettings();

    const updatePayload = {
      ...body
    };

    // Keep existing keys if not explicitly re-sent
    if (body.apiKey === undefined || body.apiKey === '') {
      updatePayload.apiKey = current.apiKey;
    }
    if (body.apiSecret === undefined || body.apiSecret === '') {
      updatePayload.apiSecret = current.apiSecret;
    }

    const saved = saveSettings(updatePayload);

    return NextResponse.json({
      success: true,
      message: 'Binance credentials and settings saved to both System Configuration and .env.local',
      settings: {
        ...saved,
        apiKey: saved.apiKey ? saved.apiKey.slice(0, 6) + '...' + saved.apiKey.slice(-4) : '',
        apiSecret: saved.apiSecret ? '••••••••' + saved.apiSecret.slice(-4) : ''
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
