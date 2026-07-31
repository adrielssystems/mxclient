import React, { useState, useMemo, useEffect } from 'react';
import { useCombobox } from 'downshift';
import { Check, ChevronsUpDown } from 'lucide-react';

export default function LocationCombobox({ items, value, onChange, placeholder, disabled, hasError }) {
    const [inputValue, setInputValue] = useState('');

    const selectedItem = useMemo(() => items.find(item => item.id == value) || null, [items, value]);

    // Update inputValue when selectedItem changes (e.g. initial load or external change)
    useEffect(() => {
        if (selectedItem) {
            setInputValue(`${selectedItem.name} - ${selectedItem.state_code || ''}`);
        } else {
            setInputValue('');
        }
    }, [selectedItem]);

    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            const search = inputValue.toLowerCase();
            const nameMatch = item.name.toLowerCase().includes(search);
            const stateMatch = (item.state_code || '').toLowerCase().includes(search);
            return nameMatch || stateMatch;
        });
    }, [items, inputValue]);

    const {
        isOpen,
        getToggleButtonProps,
        getLabelProps,
        getMenuProps,
        getInputProps,
        highlightedIndex,
        getItemProps,
        openMenu,
        selectItem
    } = useCombobox({
        items: filteredItems,
        inputValue,
        itemToString(item) {
            return item ? `${item.name} - ${item.state_code || ''}` : '';
        },
        selectedItem,
        onInputValueChange: ({ inputValue: newValue, type }) => {
            setInputValue(newValue || '');
            // Si el usuario borra todo, reseteamos el valor seleccionado
            if (!newValue) {
                onChange(null);
            }
            if (type === useCombobox.stateChangeTypes.InputChange) {
                if (!isOpen) {
                    openMenu();
                }
            }
        },
        onSelectedItemChange: ({ selectedItem }) => {
            if (selectedItem) {
                onChange(selectedItem.id);
            } else {
                onChange(null);
            }
        },
    });

    return (
        <div className="relative w-full">
            <div className={`relative w-full bg-white border rounded text-sm font-bold flex focus-within:ring-2 focus-within:ring-blue-500 transition-all ${hasError ? 'border-red-400' : 'border-slate-300'}`}>
                <input
                    {...getInputProps({
                        disabled,
                        placeholder: placeholder || 'Select Location...',
                        className: "w-full px-3 py-1.5 bg-transparent outline-none truncate disabled:opacity-50 disabled:cursor-not-allowed",
                        onFocus: () => {
                            if (!isOpen) openMenu();
                        }
                    })}
                />
                <button
                    type="button"
                    {...getToggleButtonProps({
                        disabled,
                        className: "px-2 flex items-center justify-center text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    })}
                    aria-label="toggle menu"
                >
                    <ChevronsUpDown size={14} />
                </button>
            </div>

            <ul
                {...getMenuProps()}
                className={`absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto ${!(isOpen && filteredItems.length) && 'hidden'}`}
            >
                {isOpen &&
                    filteredItems.map((item, index) => (
                        <li
                            key={item.id}
                            {...getItemProps({ item, index })}
                            className={`px-3 py-2 text-sm cursor-pointer border-b border-slate-50 last:border-0 flex items-center justify-between ${
                                highlightedIndex === index ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            <span className="font-medium truncate">{item.name} - {item.state_code}</span>
                            {selectedItem?.id === item.id && <Check size={14} className="text-blue-600 flex-shrink-0 ml-2" />}
                        </li>
                    ))}
                {isOpen && filteredItems.length === 0 && (
                    <li className="px-3 py-4 text-sm text-slate-500 text-center">No locations found</li>
                )}
            </ul>
        </div>
    );
}
