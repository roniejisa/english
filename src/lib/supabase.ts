import {createClient} from '@supabase/supabase-js';
import {supabaseProject} from './supabase-config';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||supabaseProject.url;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||supabaseProject.publishableKey;
export const supabase=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
