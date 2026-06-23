'use client';

import React, { useState, useEffect } from 'react';

interface DropdownItem {
  name: string;
  stock: string | number;
}

interface FormItem {
  type: 'Tools' | 'Machine';
  itemName: string;
  quantity: number;
}

export default function RequestForm() {
  // Form Header State
  const [formData, setFormData] = useState({
    supervisor: '',
    location: '',
    issuedTo: '',
    expectedReturn: '',
  });

  // Department Selection Toggle for the "Issued To" Section
  const [department, setDepartment] = useState<'Civil' | 'Other'>('Civil');

  // Dynamic Multi-row Array Items State
  const [items, setItems] = useState<FormItem[]>([
    { type: 'Tools', itemName: '', quantity: 1 }
  ]);

  // Master Lists fetched dynamically from Google Sheets via API
  const [supervisors, setSupervisors] = useState<string[]>([]);
  const [tools, setTools] = useState<DropdownItem[]>([]);
  const [machines, setMachines] = useState<DropdownItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false });

  // Filter input states for searching lists anywhere in the text
  const [supervisorFilter, setSupervisorFilter] = useState('');
  const [itemFilters, setItemFilters] = useState<{ [key: number]: string }>({});

  // Fetch dropdown collections on page load
  useEffect(() => {
    async function fetchDropdownData() {
      try {
        const res = await fetch('/api/dropdowns');
        const data = await res.json();
        if (data.success) {
          setSupervisors(data.supervisors || []);
          
          const formattedTools = (data.tools || []).map((t: any) => 
            typeof t === 'string' ? { name: t, stock: 'Live' } : { name: t.name || '', stock: t.stock ?? 'Live' }
          );
          const formattedMachines = (data.machines || []).map((m: any) => 
            typeof m === 'string' ? { name: m, stock: 'Live' } : { name: m.name || '', stock: m.stock ?? 'Live' }
          );

          setTools(formattedTools);
          setMachines(formattedMachines);
        }
      } catch (err) {
        console.error('Failed to load form dropdowns:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDropdownData();
  }, []);

  // Filter strings matching character keywords ANYWHERE in the name
  const filteredSupervisors = supervisors.filter(name => 
    name.toLowerCase().includes(supervisorFilter.toLowerCase())
  );

  // Dynamic Array Handlers
  const handleAddItemRow = () => {
    setItems([...items, { type: 'Tools', itemName: '', quantity: 1 }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
      const updatedFilters = { ...itemFilters };
      delete updatedFilters[index];
      setItemFilters(updatedFilters);
    }
  };

  const updateItemField = (index: number, field: keyof FormItem, value: any) => {
    const updated = [...items];
    if (field === 'type') {
      updated[index] = { ...updated[index], type: value, itemName: '' };
      setItemFilters({ ...itemFilters, [index]: '' });
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setItems(updated);
  };

  // Form Submitter
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supervisor || items.some(i => !i.itemName)) {
      setMessage({ text: 'Please fill in Supervisor and select names for all items.', isError: true });
      return;
    }

    setSubmitting(true);
    setMessage({ text: '', isError: false });

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, department, items }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ text: 'Form logs saved successfully to Google Sheets!', isError: false });
        setFormData({ supervisor: '', location: '', issuedTo: '', expectedReturn: '' });
        setSupervisorFilter('');
        setItemFilters({});
        setItems([{ type: 'Tools', itemName: '', quantity: 1 }]);
      } else {
        throw new Error(data.error || 'Unknown submission server error.');
      }
    } catch (err: any) {
      setMessage({ text: `Submission Failed: ${err.message}`, isError: true });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-semibold text-lg">Syncing Live Master Inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center border-b pb-4">
          Civil Tracker Request Form
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section: Header Block Context */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            
            {/* SUPERVISOR SEARCH & SELECTION COMPONENT */}
            <div className="flex flex-col space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">Supervisor</label>
                <input
                  type="text"
                  placeholder="🔍 Filter list..."
                  className="w-1/2 max-w-[180px] bg-white border border-gray-300 rounded-md px-2 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={supervisorFilter}
                  onChange={(e) => setSupervisorFilter(e.target.value)}
                />
              </div>
              <select
                required
                className="w-full bg-gray-50 border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 outline-none"
                value={formData.supervisor}
                onChange={(e) => setFormData({ ...formData, supervisor: e.target.value })}
              >
                <option value="">-- Choose Supervisor --</option>
                {filteredSupervisors.map((name, i) => (
                  <option key={i} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-gray-700">Location / Site</label>
              <input
                type="text"
                required
                className="w-full bg-gray-50 border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            {/* ISSUED TO SECTION WITH CIVIL / OTHER DEPT TOGGLE BUTTONS */}
            <div className="flex flex-col col-span-1 sm:col-span-2 bg-gray-50 p-4 rounded-md border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">Issued To (Worker Context)</label>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setDepartment('Civil')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all duration-150 ${
                    department === 'Civil' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  Civil Dept
                </button>
                <button
                  type="button"
                  onClick={() => setDepartment('Other')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all duration-150 ${
                    department === 'Other' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  Other Depts
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="Enter worker's full name..."
                className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={formData.issuedTo}
                onChange={(e) => setFormData({ ...formData, issuedTo: e.target.value })}
              />
            </div>

            <div className="flex flex-col space-y-1 col-span-1 sm:col-span-2">
              <label className="text-sm font-medium text-gray-700">Expected Return Date</label>
              <input
                type="date"
                required
                className="w-full bg-gray-50 border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={formData.expectedReturn}
                onChange={(e) => setFormData({ ...formData, expectedReturn: e.target.value })}
              />
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* Section: Multi-item Row Allocator */}
          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Requested Items Checklist</h2>
            <div className="space-y-4">
              {items.map((item, index) => {
                const masterList = item.type === 'Tools' ? tools : machines;
                const currentFilter = itemFilters[index] || '';
                
                // Live filter items list matching string text
                const filteredItems = masterList.filter(availItem =>
                  availItem.name.toLowerCase().includes(currentFilter.toLowerCase())
                );
                
                return (
                  <div key={index} className="flex flex-col sm:flex-row gap-4 items-end bg-gray-50 p-4 rounded-md border border-gray-200 relative">
                    <div className="w-full sm:w-1/4 flex flex-col space-y-1">
                      <label className="text-xs font-medium text-gray-600">Category</label>
                      <select
                        className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                        value={item.type}
                        onChange={(e) => updateItemField(index, 'type', e.target.value as any)}
                      >
                        <option value="Tools">Tools</option>
                        <option value="Machine">Machine</option>
                      </select>
                    </div>

                    {/* ITEM DROPDOWN WITH COMPACT INTEGRATED INLINE SEARCH BAR */}
                    <div className="w-full sm:w-2/4 flex flex-col space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-medium text-gray-600">Item Selection</label>
                        <input
                          type="text"
                          placeholder="🔍 Filter item..."
                          className="w-1/2 bg-white border border-gray-300 rounded-md px-2 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                          value={currentFilter}
                          onChange={(e) => setItemFilters({ ...itemFilters, [index]: e.target.value })}
                        />
                      </div>
                      <select
                        required
                        className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        value={item.itemName}
                        onChange={(e) => updateItemField(index, 'itemName', e.target.value)}
                      >
                        <option value="">-- Choose {item.type} --</option>
                        {filteredItems.map((availItem, i) => (
                          <option key={i} value={availItem.name}>
                            {availItem.name} (Stock: {availItem.stock})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-full sm:w-1/4 flex flex-col space-y-1">
                      <label className="text-xs font-medium text-gray-600">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        required
                        className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                        value={item.quantity}
                        onChange={(e) => updateItemField(index, 'quantity', parseInt(e.target.value) || 1)}
                      />
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(index)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium border border-red-200 bg-white rounded-md px-3 py-2 h-[38px] transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAddItemRow}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center transition-colors"
            >
              + Add Another Item Line
            </button>
          </div>

          {/* Feedback Messages */}
          {message.text && (
            <div className={`p-3 rounded-md text-sm font-medium ${message.isError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
              {message.text}
            </div>
          )}

          {/* Execution triggers */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-md text-sm transition duration-150 disabled:bg-blue-400 shadow-sm"
          >
            {submitting ? 'Transmitting Data to Logs...' : 'Submit Request Form'}
          </button>
        </form>
      </div>
    </main>
  );
}