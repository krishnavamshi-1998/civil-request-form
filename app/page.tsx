'use client';
import { useState, useEffect } from 'react';

interface DropdownData {
  supervisors: string[];
  tools: string[];
  machines: string[];
}

interface ItemRow {
  type: 'Tools' | 'Machine';
  itemName: string;
  quantity: number;
}

export default function MultiIssuingForm() {
  const [dropdowns, setDropdowns] = useState<DropdownData>({ supervisors: [], tools: [], machines: [] });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const initialOrderData = { supervisor: '', location: '', issuedTo: 'Civil', expectedReturn: '' };
  const initialItemRow: ItemRow = { type: 'Machine', itemName: '', quantity: 1 };

  const [orderData, setOrderData] = useState(initialOrderData);
  const [items, setItems] = useState<ItemRow[]>([initialItemRow]);

  useEffect(() => {
    fetch('/api/dropdowns')
      .then(res => res.json())
      .then((data: DropdownData) => {
        setDropdowns(data);
        setLoading(false);
      })
      .catch(err => console.error("Failed to load list data:", err));
  }, []);

  const handleItemChange = (index: number, field: keyof ItemRow, value: any) => {
    const updatedItems = [...items];
    if (field === 'type') {
      updatedItems[index] = { type: value, itemName: '', quantity: 1 };
    } else {
      updatedItems[index] = { ...updatedItems[index], [field]: value };
    }
    setItems(updatedItems);
  };

  const addItemRow = () => setItems([...items, { type: 'Machine', itemName: '', quantity: 1 }]);
  const removeItemRow = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const payload = { ...orderData, items };
    
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        alert('All items successfully sent to Google Sheets!');
        setOrderData(initialOrderData);
        setItems([ { type: 'Machine', itemName: '', quantity: 1 } ]);
      } else {
        alert('Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error. Check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-700 font-medium">
        Loading list from Google Sheet...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 py-6 px-4 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-md border border-gray-200 p-6 space-y-6">
        
        <div className="border-b border-gray-200 pb-3">
          <h1 className="text-xl font-bold text-gray-800">Civil Tools & Machine Request Form</h1>
          <p className="text-sm text-gray-500">Fill in the fields below to log entries to the sheet.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Supervisor Name</label>
              <select 
                required 
                className="block w-full rounded-lg border border-gray-300 p-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                value={orderData.supervisor} 
                onChange={e => setOrderData({...orderData, supervisor: e.target.value})}
              >
                <option value="">-- Choose Supervisor --</option>
                {dropdowns.supervisors.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Location</label>
              <input 
                type="text" 
                required 
                placeholder="Enter location"
                className="block w-full rounded-lg border border-gray-300 p-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                value={orderData.location} 
                onChange={e => setOrderData({...orderData, location: e.target.value})} 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Issued To</label>
            <div className="flex w-full rounded-lg overflow-hidden border border-gray-300" role="group">
              <button
                type="button"
                className={`w-1/2 py-2 text-sm font-bold border-r border-gray-300 transition-colors ${
                  orderData.issuedTo === 'Civil'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => setOrderData({ ...orderData, issuedTo: 'Civil' })}
              >
                Civil
              </button>
              <button
                type="button"
                className={`w-1/2 py-2 text-sm font-bold transition-colors ${
                  orderData.issuedTo === 'Other Depts'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => setOrderData({ ...orderData, issuedTo: 'Other Depts' })}
              >
                Other Depts
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-800 border-b border-gray-200 pb-1">Items</label>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {items.map((item, index) => (
                <div key={index} className="flex flex-wrap md:flex-nowrap items-end gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  
                  <div className="w-full md:w-1/4">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                    <select 
                      className="block w-full rounded-lg border border-gray-300 p-2 text-sm bg-white text-gray-900" 
                      value={item.type} 
                      onChange={e => handleItemChange(index, 'type', e.target.value)}
                    >
                      <option value="Machine">Machine</option>
                      <option value="Tools">Tools</option>
                    </select>
                  </div>

                  <div className="w-full md:w-2/4">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Item Name</label>
                    <select 
                      required 
                      className="block w-full rounded-lg border border-gray-300 p-2 text-sm bg-white text-gray-900" 
                      value={item.itemName} 
                      onChange={e => handleItemChange(index, 'itemName', e.target.value)}
                    >
                      <option value="">-- Select Item --</option>
                      {item.type === 'Tools' 
                        ? dropdowns.tools.map(t => <option key={t} value={t}>{t}</option>)
                        : dropdowns.machines.map(m => <option key={m} value={m}>{m}</option>)
                      }
                    </select>
                  </div>

                  <div className="w-full md:w-1/4 flex gap-2 items-center">
                    <div className="w-full">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity</label>
                      <input 
                        type="number" 
                        min="1" 
                        required 
                        className="block w-full rounded-lg border border-gray-300 p-2 text-sm bg-white text-gray-900 text-center font-bold" 
                        value={item.quantity} 
                        onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)} 
                      />
                    </div>
                    
                    {items.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => removeItemRow(index)} 
                        className="p-2 mt-5 text-gray-400 hover:text-red-500 font-bold transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                </div>
              ))}
            </div>

            <button 
              type="button" 
              onClick={addItemRow} 
              className="text-xs bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold py-2 px-3 rounded-lg transition-colors"
            >
              + Add Another Item
            </button>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Expected Return Date</label>
            <input 
              type="date" 
              required 
              className="block w-full rounded-lg border border-gray-300 p-2.5 text-sm bg-white text-gray-900 cursor-pointer" 
              value={orderData.expectedReturn} 
              onChange={e => setOrderData({...orderData, expectedReturn: e.target.value})} 
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow transition-colors ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? 'Saving items to sheets...' : 'Submit Request'}
          </button>
        </form>

      </div>
    </main>
  );
}