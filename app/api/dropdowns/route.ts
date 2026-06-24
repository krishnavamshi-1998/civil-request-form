import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  console.log('--- LOG: [1/4] Dropdowns Request Triggered ---');
  
  try {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Log variable availability safely (without leaking secrets)
    console.log(`--- LOG: [2/4] Inspecting Environment Variables ---`);
    console.log(`> SPREADSHEET_ID Exists: ${!!spreadsheetId} (Length: ${spreadsheetId?.length || 0})`);
    console.log(`> EMAIL Exists: ${!!email} (Value: ${email})`);
    console.log(`> PRIVATE_KEY Exists: ${!!privateKey} (Length: ${privateKey?.length || 0})`);

    if (!privateKey || !email || !spreadsheetId) {
      throw new Error(`CRITICAL: Missing environment configuration keys.`);
    }

    // Sanitize Key
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    console.log('--- LOG: [3/4] Initializing Google Authentication Client ---');
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: email,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    console.log(`--- LOG: [4/4] Sending Request to Google API for Sheet ID: ${spreadsheetId} ---`);
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [
        'Master Stock!B3:B', 
        'Master Stock!J3:J', 
        'Master Stock!R3:R', 
      ],
    });

    console.log('--- LOG: SUCCESS! Data received safely from Google Sheets ---');

    const valueRanges = response.data.valueRanges || [];
    const toolsRaw = valueRanges[0] && valueRanges[0].values ? valueRanges[0].values : [];
    const machinesRaw = valueRanges[1] && valueRanges[1].values ? valueRanges[1].values : [];
    const supervisorsRaw = valueRanges[2] && valueRanges[2].values ? valueRanges[2].values : [];

    const tools = toolsRaw.flat().filter((item) => item && item.trim() !== '').map((item) => ({ name: item, stock: 'Available' }));
    const machines = machinesRaw.flat().filter((item) => item && item.trim() !== '').map((item) => ({ name: item, stock: 'Available' }));
    const supervisors = supervisorsRaw.flat().filter((item) => item && item.trim() !== '') as string[];

    return NextResponse.json({
      success: true,
      supervisors,
      tools,
      machines,
    });

  } catch (error: any) {
    console.error('--- !!! CRITICAL RUNTIME EXCEPTION ERROR !!! ---');
    console.error('Message:', error.message || error);
    if (error.response?.data) {
      console.error('Google API Error Response payload:', JSON.stringify(error.response.data));
    }
    console.error('------------------------------------------------');
    
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch tracking dropdown entries' },
      { status: 500 }
    );
  }
}