"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Lock, Github, AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function LoginForm() {
  const [oauthLoading, setOauthLoading] = React.useState<string | null>(null);
  
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const errorDetails = searchParams.get("details");
  
  // Safe client creation
  const supabase = React.useMemo(() => {
      try {
          return createClient();
      } catch (e) {
          console.error("Supabase client init error:", e);
          return null;
      }
  }, []);

  React.useEffect(() => {
    if (errorParam === "unauthorized") {
      toast.error("Akun Anda tidak memiliki akses admin.");
    }
    if (errorParam === "auth-code-error") {
      const detailMsg = errorDetails ? `: ${decodeURIComponent(errorDetails)}` : "";
      toast.error(`Gagal verifikasi login${detailMsg}. Silakan coba lagi.`);
    }
  }, [errorParam, errorDetails]);

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    console.log(`Attempting login with ${provider}...`);
    if (!supabase) {
        toast.error("Konfigurasi sistem bermasalah (Supabase Client).");
        return;
    }
    if (oauthLoading) return;

    setOauthLoading(provider);
    try {
      const redirectUrl = `${window.location.origin}/auth/callback?next=/admin`;
      console.log("Redirecting to:", redirectUrl);
      console.log("IMPORTANT: Ensure this URL is added to Supabase > Auth > URL Configuration > Redirect URLs");
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (error) throw error;
      // Note: signInWithOAuth redirects, so we might not reach here if successful immediately,
      // but usually it awaits the initial handshake.
    } catch (error) {
      const message = error instanceof Error ? error.message : `Gagal login dengan ${provider}`;
      console.error("OAuth error:", error);
      toast.error(message);
      setOauthLoading(null);
    }
  };

  if (!supabase) {
      return (
          <Alert variant="destructive" className="max-w-md mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Konfigurasi</AlertTitle>
            <AlertDescription>
              Supabase client tidak dapat diinisialisasi. Cek environment variables.
            </AlertDescription>
          </Alert>
      );
  }

  return (
    <Card className="w-full max-w-md shadow-lg border-primary/10">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-primary/10 p-3">
            <Lock className="w-6 h-6 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">Admin Login</CardTitle>
        <CardDescription>
          Akses terbatas hanya untuk administrator yang terdaftar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {errorParam === "unauthorized" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Akses Ditolak</AlertTitle>
            <AlertDescription>
              Akun email Anda tidak terdaftar sebagai admin.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4">
          <Button 
            variant="outline" 
            className="w-full h-12 text-base"
            onClick={() => handleOAuthLogin('google')}
            disabled={!!oauthLoading}
          >
            {oauthLoading === 'google' ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
                <svg className="mr-2 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                </svg>
            )}
            Login dengan Google
          </Button>
          <Button 
            variant="outline" 
            className="w-full h-12 text-base"
            onClick={() => handleOAuthLogin('github')}
            disabled={!!oauthLoading}
          >
            {oauthLoading === 'github' ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
                <Github className="mr-2 h-5 w-5" />
            )}
            Login dengan GitHub
          </Button>
        </div>
        
        <p className="text-center text-xs text-muted-foreground pt-4">
          Pastikan akun email Anda telah terdaftar sebagai administrator.
        </p>
      </CardContent>
    </Card>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
      <React.Suspense fallback={<div className="flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
        <LoginForm />
      </React.Suspense>
    </div>
  );
}
