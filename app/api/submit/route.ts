import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 1. Extract what the frontend sent
    let { 
      supervisorName, 
      supervisorContact, 
      category, 
      itemName, 
      quantity, 
      actionType, // 'issue' or 'return'
      remarks 
    } = body;

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!privateKey || !email || !spreadsheetId) {
      throw new Error('Missing Google Credentials in Environment Variables.');
    }
    
    privateKey = privateKey.startsWith('"') && privateKey.endsWith('"') ? privateKey.slice(1, -1) : privateKey;
    privateKey = privateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // ==========================================
    // 🔍 AUTOMATIC BACKUP LOOKUP (If phone is missing/blank)
    // ==========================================
    if (supervisorName && (!supervisorContact || supervisorContact.trim() === '')) {
      try {
        const masterRes = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'Tools and Machines Master Stock'!A1:Z500`
        });
        const masterRows = masterRes.data.values || [];
        
        if (masterRows.length > 0) {
          const headers = masterRows[0].map((h: any) => String(h).trim().toLowerCase());
          const nameColIdx = headers.findIndex((h: string) => h.includes('supervisor name') || h === 'supervisor');
          const contactColIdx = headers.findIndex((h: string) => h.includes('supervisor contact') || h === 'contact' || h === 'phone');

          if (nameColIdx !== -1 && contactColIdx !== -1) {
            // Scan for a matching supervisor to fetch their contact
            for (let i = 1; i < masterRows.length; i++) {
              const row = masterRows[i];
              const nameInRow = row[nameColIdx] ? String(row[nameColIdx]).trim() : '';
              if (nameInRow.toLowerCase() === supervisorName.trim().toLowerCase()) {
                supervisorContact = row[contactColIdx] ? String(row[contactColIdx]).trim() : '';
                break; // Found! Stop scanning
              }
            }
          }
        }
      } catch (lookupError) {
        console.error("Auto-contact lookup failed, proceeding with original values:", lookupError);
      }
    }

    // ==========================================
    // ✍️ APPEND ROW TO THE LOGS/TRANSACTIONS SHEET
    // ==========================================
    // Adjust target sheet name ('Form Submissions' or 'Transactions') to match yours
    const targetSheet = "Form Submissions"; 
    
    const timestamp = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }); // Dynamic timestamp
    
    // Align row structure exactly with your Spreadsheet columns
    const rowData = [
      timestamp,
      supervisorName || '',
      supervisorContact || '', // Populated automatically on backend
      category || '',
      itemName || '',
      quantity || '',
      actionType || '',
      remarks || ''
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${targetSheet}'!A:H`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData]
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: "Form successfully saved!",
      supervisorContact // Returned back to frontend as confirmation
    });

  } catch (error: any) {
    console.error("Submit API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}