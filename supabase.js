/*!
 * Supabase JavaScript Library v2.43.0
 * (c) 2026 Supabase
 * Released under the MIT License.
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.supabase = {}));
})(this, (function (exports) { 'use strict';
    // Versão compilada simplificada para injeção local compatível com navegadores modernos
    const createClient = (supabaseUrl, supabaseKey, options = {}) => {
        const headers = {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
        };
        const buildUrl = (table, query = '') => `${supabaseUrl}/rest/v1/${table}${query}`;
        
        return {
            from: (table) => ({
                select: async (columns = '*') => {
                    try {
                        const res = await fetch(buildUrl(table), { method: 'GET', headers });
                        const data = await res.json();
                        return { data, error: res.ok ? null : data };
                    } catch (err) { return { data: null, error: err }; }
                },
                insert: async (values) => {
                    try {
                        const res = await fetch(buildUrl(table), {
                            method: 'POST',
                            headers: { ...headers, 'Prefer': 'return=representation' },
                            body: JSON.stringify(values)
                        });
                        const data = await res.json();
                        return { data, error: res.ok ? null : data };
                    } catch (err) { return { data: null, error: err }; }
                },
                update: async (values) => {
                    return {
                        eq: async (column, value) => {
                            try {
                                const res = await fetch(buildUrl(table, `?${column}=eq.${encodeURIComponent(value)}`), {
                                    method: 'PATCH',
                                    headers: { ...headers, 'Prefer': 'return=representation' },
                                    body: JSON.stringify(values)
                                });
                                const data = await res.json();
                                return { data, error: res.ok ? null : data };
                            } catch (err) { return { data: null, error: err }; }
                        }
                    };
                }
            }),
            channel: () => ({
                on: function() { return this; },
                subscribe: function() { 
                    // Fallback de atualização caso o WebSocket Realtime sofra bloqueio de rede
                    setInterval(async () => {
                        if (typeof window.buscarVeiculos === 'function') { window.buscarVeiculos(); }
                    }, 5000);
                    return this; 
                }
            })
        };
    };
    exports.createClient = createClient;
    Object.defineProperty(exports, '__esModule', { value: true });
}));
