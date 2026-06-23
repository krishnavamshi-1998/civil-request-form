'use client';

import React, { useState, useEffect } from 'react';
import Select from 'react-select';

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

  // Fetch dropdown collections on page load
  useEffect(() => {
    async function fetchDropdownData() {
      try {
        const res = await fetch('/api/dropdowns');
        const data = await res.json();
        if (data.success) {
          setSupervisors(data.supervisors || []);
          setTools(data.tools || []);
          setMachines(data.machines || []);
        }
      } catch (err) {
        console.error('Failed to load form dropdowns:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDropdownData();
  }, []);

  // Standard Tailwind Design configuration map for react-select components
  const customSelectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      backgroundColor: '#F9FAFB', // matching bg-gray-50
      borderColor: state.isFocused ? '#3B82F6' : '#D1D5DB', // blue-500 vs gray-300
      borderRadius: '0.375rem', // rounded-md
      paddingTop: '2px',
      paddingBottom: '2px',
      boxShadow: state.isFocused ? '0 0 0 1px #3B82F6' : 'none',
      '&:hover': { borderColor: '#9CA3AF' }
    }),
    menu: (base: any) => ({
      ...base,
      zIndex: 50,
      backgroundColor: '#FFFFFF',
      borderRadius: '0.375rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected ? '#3B82F6' : state.isFocused ? '#EFF6FF' : '#FFFFFF',
      color: state.isSelected ? '#FFFFFF' : '#1F2937',
      cursor: 'pointer'
    }),
    input: (base: any) => ({
      ...base,
      'input:focus': { boxShadow: 'none' } // Disables clash with @tailwindcss/forms plugin layout rules
    })
  };

  // Convert raw master collections to react-select { value, label } formats
  const supervisorOptions = supervisors.map((name) => ({ value: name, label: name }));
  
  const toolOptions = tools.map((t) => ({
    value: t.name,
    label: `${t.name} (Available: ${t.stock})`
  }));

  const machineOptions = machines.map((m) => ({
    value: m.name,
    label: `${m.name} (Available: ${m.stock})`
  }));

  // Dynamic Array Handlers
  const handleAddItemRow = () => {
    setItems([...items, { type: 'Tools', itemName: '', quantity: 1 }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItemField = (index: number, field: keyof FormItem, value: any) => {
    const updated = [...items];
    if (field === 'type') {
      // If switching selection groups, reset item reference selection
      updated[index] = { ...updated[index], type: value, itemName: '' };
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
        body: JSON.stringify({ ...formData, items }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ text: 'Form logs saved successfully to Google Sheets!', isError: false });
        // Reset inputs on completion
        setFormData({ supervisor: '', location: '', issuedTo: '', expectedReturn: '' });
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
        <p className="text-gray-600 font-semibold text-lg">Syncing Master Inventory Options...</p>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor</label>
              <Select
                options={supervisorOptions}
                placeholder="Search supervisor..."
                isSearchable={true}
                styles={customSelectStyles}
                value={supervisorOptions.find(o => o.value === formData.supervisor) || null}
                onChange={(opt) => setFormData({ ...formData, supervisor: opt?.value || '' })}
              />
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issued To (Worker Name)</label>
              <input
                type="text"
                required
                className="w-full bg-gray-50 border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
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
                const currentOptions = item.type === 'Tools' ? toolOptions : machineOptions;
                
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

                    <div className="w-full sm:w-2/4">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Item Selection (Searchable)</label>
                      <Select
                        options={currentOptions}
                        placeholder={`Search standard ${item.type.toLowerCase()}...`}
                        isSearchable={true}
                        styles={customSelectStyles}
                        value={currentOptions.find(o => o.value === item.itemName) || null}
                        onChange={(opt) => updateItemField(index, 'itemName', opt?.value || '')}
                      />
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