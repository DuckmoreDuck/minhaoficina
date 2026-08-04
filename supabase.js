/*!
 * Supabase JavaScript Library (Versão Leve Personalizada)
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.supabase = {}));
})(this, (function (exports) { 'use strict';

    const createClient = (supabaseUrl, supabaseKey, options = {}) => {
        const headers = {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
        };
        const buildUrl = (table, query = '') => `${supabaseUrl}/rest/v1/${table}${query}`;
        
        return {
            from: (table) => ({
                // 🔍 SELECT
                select: async (columns = '*') => {
                    try {
                        const res = await fetch(buildUrl(table), { method: 'GET', headers });
                        const data = await res.json();
                        return { data, error: res.ok ? null : data };
                    } catch (err) { return { data: null, error: err }; }
                },
                // ➕ INSERT
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
                // ✏️ UPDATE
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
                },
                // 🗑️ DELETE (Adicionado)
                delete: () => {
                    return {
                        eq: async (column, value) => {
                            try {
                                const res = await fetch(buildUrl(table, `?${column}=eq.${encodeURIComponent(value)}`), {
                                    method: 'DELETE',
                                    headers
                                });
                                return { data: true, error: res.ok ? null : true };
                            } catch (err) { return { data: null, error: err }; }
                        }
                    };
                }
            }),
            // 🔄 ATUALIZAÇÃO AUTOMÁTICA EM TEMPO REAL (Polling a cada 5s)
            channel: () => ({
                on: function() { return this; },
                subscribe: function() { 
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

// 🟢 CONFIGURAÇÃO E INICIALIZAÇÃO DA SUA CONTA SUPABASE
// (Substitua pelos dados reais do seu painel do Supabase)
const SUPABASE_URL = 'https://bwrbduzlcbfbsrrnowam.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3cmJkdXpsY2JmYnNycm5vd2FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NjYwMDgsImV4cCI6MjEwMTM0MjAwOH0.APLWUjOFPUFoqZ-_DMfjpFlo0xCw2W_drBjA_8EDrQw';

// Variável global usada no app.js
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
