// Configuração Oficial do Supabase
const SUPABASE_URL = 'https://bwrbduzlcbfbsrrnowam.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3cmJkdXpsY2JmYnNycm5vd2FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NjYwMDgsImV4cCI6MjEwMTM0MjAwOH0.APLWUjOFPUFoqZ-_DMfjpFlo0xCw2W_drBjA_8EDrQw'; // Insira a sua chave pública anon aqui

// Inicializa a biblioteca oficial
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
