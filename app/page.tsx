'use client';

import React, { useState, useEffect, useRef } from 'react';

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

  // Custom Search UI Overlay Dropdown Controllers
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [itemSearchText, setItemSearchText] = useState<{ [key: number]: string }>({});
  
  const [showSupDropdown, setShowSupDropdown] = useState(false);
  const [supSearchText, setSupSearchText] = useState('');

  const supervisorRef = useRef<HTMLDivElement>(null);

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

  // Close custom drop panels when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (supervisorRef.current && !supervisorRef.current.contains(event.target as Node)) {
        setShowSupDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter Supervisor Array matching string ANYWHERE
  const filteredSupervisors = supervisors.filter(name => 
    name.toLowerCase().includes(supSearchText.toLowerCase())
  );

  // Dynamic Row Handlers
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
    updated[index] = { ...updated[index], [field]: value };
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
        setFormData({ supervisor: '', location: '', issuedTo: '', expectedReturn: '' });
        setSupSearchText('');
        setItemSearchText({});
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
            
            {/* SEARCHABLE SUPERVISOR DROPDOWN */}
            <div ref={supervisorRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor</label>
              <input
                type="text"
                placeholder="Type to search supervisor..."
                className="w-full bg-gray-50 border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                value={supSearchText}
                onFocus={() => setShowSupDropdown(true)}
                onChange={(e) => {
                  setSupSearchText(e.target.value);
                  setShowSupDropdown(true);
                  setFormData({ ...formData, supervisor: '' }); // Reset until selected
                }}
              />
              {showSupDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredSupervisors.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500">No match found</div>
                  ) : (
                    filteredSupervisors.map((name, i) => (
                      <div
                        key={i}
                        className="p-2 text-sm hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                        onClick={() => {
                          setSupSearchText(name);
                          setFormData({ ...formData, supervisor: name });
                          setShowSupDropdown(false);
                        }}
                      >
                        {name}
                      </div>
                    ))
                  )}
                </div>
              )}
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
                const masterList = item.type === 'Tools' ? tools : machines;
                const typedText = itemSearchText[index] ?? item.itemName;
                
                // Filter matching characters ANYWHERE in the item name
                const filteredItems = masterList.filter(availItem =>
                  availItem.name.toLowerCase().includes(typedText.toLowerCase())
                );

                return (
                  <div key={index} className="flex flex-col sm:flex-row gap-3 items-end bg-gray-50 p-4 rounded-md border relative">
                    
                    <div className="w-full sm:w-1/4">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                      <select
                        className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm"
                        value={item.type}
                        onChange={(e) => {
                          updateItemField(index, 'type', e.target.value as any);
                          updateItemField(index, 'itemName', ''); // Reset choice
                          setItemSearchText({ ...itemSearchText, [index]: '' }); // Reset text
                        }}
                      >
                        <option value="Tools">Tools</option>
                        <option value="Machine">Machine</option>
                      </select>
                    </div>

                    {/* LIVE GLOBAL FILTER SEARCH BOX */}
                    <div className="w-full sm:w-2/4 relative">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Item Selection (Type to Search)</label>
                      <input
                        type="text"
                        placeholder={`Search ${item.type.toLowerCase()} name...`}
                        className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500"
                        value={typedText}
                        onFocus={() => setActiveSearchIndex(index)}
                        onChange={(e) => {
                          setItemSearchText({ ...itemSearchText, [index]: e.target.value });
                          updateItemField(index, 'itemName', ''); // Reset explicit value until clicked
                          setActiveSearchIndex(index);
                        }}
                      />
                      
                      {activeSearchIndex === index && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto left-0">
                          {filteredItems.length === 0 ? (
                            <div className="p-2 text-sm text-gray-500">No matching stock items</div>
                          ) : (
                            filteredItems.map((availItem, i) => (
                              <div
                                key={i}
                                className="p-2 text-sm hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex justify-between"
                                onClick={() => {
                                  updateItemField(index, 'itemName', availItem.name);
                                  setItemSearchText({ ...itemSearchText, [index]: availItem.name });
                                  setActiveSearchIndex(null); // Close panel
                                }}
                              >
                                <span>{availItem.name}</span>
                                <span className="text-xs text-gray-400 font-mono">Stock: {availItem.stock}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
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
                        onClick={() => {
                          handleRemoveItemRow(index);
                          setActiveSearchIndex(null);
                        }}
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
              onClick={() => {
                handleAddItemRow();
                setActiveSearchIndex(null);
              }}
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