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

  // Filter input states for searching lists
  const [supervisorFilter, setSupervisorFilter] = useState('');
  const [itemFilters, setItemFilters] = useState<{ [key: number]: string }>({});

  // Fetch dropdown collections on page load and handle BOTH data formats safely
  useEffect(() => {
    async function fetchDropdownData() {
      try {
        const res = await fetch('/api/dropdowns');
        const data = await res.json();
        if (data.success) {
          setSupervisors(data.supervisors || []);
          
          // Safety Map: Converts either raw strings or stock objects into clean formats
          const formattedTools = (data.tools || []).map((t: any) => 
            typeof t === 'string' ? { name: t, stock: 'Live' } : { name: t.name, stock: t.stock }
          );
          const formattedMachines = (data.machines || []).map((m: any) => 
            typeof m === 'string' ? { name: m, stock: 'Live' } : { name: m.name, stock: m.stock }
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
        <p className="text-gray-600 font-semibold text-lg">Syncing Live Master Inventory...</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* SUPERVISOR SEARCH SELECTION PANEL */}
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor</label>
              <input
                type="text"
                placeholder="🔍 Search supervisor name..."
                className="w-full bg-gray-50 border border-gray-300 rounded-md p-1.5 text-xs focus:ring-blue-500 focus:border-blue-500 mb-1"
                value={supervisorFilter}
                onChange={(e) => setSupervisorFilter(e.target.value)}
              />
              <select
                required
                className="w-full bg-gray-50 border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                value={formData.supervisor}
                onChange={(e) => setFormData({ ...formData, supervisor: e.target.value })}
              >
                <option value="">-- Choose Supervisor --</option>
                {filteredSupervisors.map((name, i) => (
                  <option key={i} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location / Site</label>
              <input
                type="text"
                required
                className="w-full bg-gray-50 border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            {/* ISSUED TO SECTION WITH RESTORED CIVIL / OTHER DEPT TOGGLE BUTTONS */}
            <div className="flex flex-col col-span-1 sm:col-span-2 bg-gray-50 p-3 rounded-md border">
              <label className="block text-sm font-medium text-gray-700 mb-2">Issued To (Worker Context)</label>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setDepartment('Civil')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-colors duration-150 ${
                    department === 'Civil' ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-700 border hover:bg-gray-100'
                  }`}
                >
                  Civil Dept
                </button>
                <button
                  type="button"
                  onClick={() => setDepartment('Other')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-colors duration-150 ${
                    department === 'Other' ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-700 border hover:bg-gray-100'
                  }`}
                >
                  Other Depts
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="Enter worker's full name..."
                className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                value={formData.issuedTo}
                onChange={(e) => setFormData({ ...formData, issuedTo: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Return Date</label>
              <input
                type="date"
                required
                className="w-full bg-gray-50 border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                value={formData.expectedReturn}
                onChange={(e) => setFormData({ ...formData, expectedReturn: e.target.value })}
              />
            </div>
          </div>

          <hr />

          {/* Section: Multi-item Row Allocator */}
          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Requested Items Checklist</h2>
            <div className="space-y-4">
              {items.map((item, index) => {
                const masterList = item.type === 'Tools' ? tools : machines;
                const currentFilter = itemFilters[index] || '';
                
                // Live filter items array anywhere in the text line
                const filteredItems = masterList.filter(availItem =>
                  availItem.name.toLowerCase().includes(currentFilter.toLowerCase())
                );
                
                return (
                  <div key={index} className="flex flex-col sm:flex-row gap-3 items-end bg-gray-50 p-4 rounded-md border relative">
                    <div className="w-full sm:w-1/4">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                      <select
                        className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm"
                        value={item.type}
                        onChange={(e) => updateItemField(index, 'type', e.target.value as any)}
                      >
                        <option value="Tools">Tools</option>
                        <option value="Machine">Machine</option>
                      </select>
                    </div>

                    {/* SELECT DROPDOWN FEATURING LIVE INLINE KEYWORD TEXT SELECTION FILTER */}
                    <div className="w-full sm:w-2/4 flex flex-col">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Item Selection</label>
                      <input
                        type="text"
                        placeholder={`🔍 Search standard ${item.type.toLowerCase()}...`}
                        className="w-full bg-white border border-gray-300 rounded-md p-1.5 text-xs focus:ring-blue-500 mb-1"
                        value={currentFilter}
                        onChange={(e) => setItemFilters({ ...itemFilters, [index]: e.target.value })}
                      />
                      <select
                        required
                        className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500"
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

                    <div className="w-full sm:w-1/4">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        required
                        className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm"
                        value={item.quantity}
                        onChange={(e) => updateItemField(index, 'quantity', parseInt(e.target.value) || 1)}
                      />
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(index)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium border border-red-200 bg-white rounded-md px-3 py-2 h-9 sm:mb-0.5"
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
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center"
            >
              + Add Another Item Line
            </button>
          </div>

          {/* Feedback Messages */}
          {message.text && (
            <div className={`p-3 rounded-md text-sm ${message.isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {message.text}
            </div>
          )}

          {/* Execution triggers */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-md text-sm transition duration-150 disabled:bg-blue-400"
          >
            {submitting ? 'Transmitting Data to Logs...' : 'Submit Request Form'}
          </button>
        </form>
      </div>
    </main>
  );
}