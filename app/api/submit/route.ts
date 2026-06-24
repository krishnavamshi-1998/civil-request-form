import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Destructuring fields to match the updated form payload
    const { supervisor, location, expectedReturn, issuedTo, items } = body;

    // 1. Guard rails for validation
    if (!supervisor || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required request form elements' },
        { status: 400 }
      );
    }

    // 2. Extract and Sanitize Credentials
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!privateKey || !email || !spreadsheetId) {
      throw new Error('CRITICAL: Missing environment configuration keys in submission handler.');
    }

    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    // 3. Initialize Google Auth with Read/Write access scope
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: email,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // 4. Separate items into Tools and Machines buckets matching the exact column blueprint
    const toolRows: any[][] = [];
    const machineRows: any[][] = [];

    items.forEach((item: any) => {
      const rowData = [
        '=ROW()-1',         // Column A: S. No (Dynamic Row Auto-Counter)
        timestamp,          // Column B: Timestamp
        supervisor,         // Column C: Supervisor Name
        location,           // Column D: Location
        issuedTo,           // Column E: Issued To
        item.itemName,      // Column F: Tool/Machine Name (Category dropped!)
        item.quantity,      // Column G: Quantity
        expectedReturn      // Column H: Expected Return Date
      ];

      // Routing logic based on type, but category itself is excluded from row data
      if (item.type === 'Tools') {
        toolRows.push(rowData);
      } else if (item.type === 'Machine') {
        machineRows.push(rowData);
      }
    });

    // 5. Fire parallel appends targeting the strict A:H limits
    const appendPromises = [];

    if (toolRows.length > 0) {
      appendPromises.push(
        sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'Tools!A:H', 
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: toolRows },
        })
      );
    }

    if (machineRows.length > 0) {
      appendPromises.push(
        sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'Machines!A:H', 
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: machineRows },
        })
      );
    }

    await Promise.all(appendPromises);

    return NextResponse.json({ success: true, message: 'Data successfully logged with new layout alignment!' });

  } catch (error: any) {
    console.error('Google Sheets Submission Failure:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal transmission failure' },
      { status: 500 }
    );
  }
}