import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { useNavigate } from 'react-router-dom';
import { toast } from './ui/use-toast';
import { ArrowLeft } from 'lucide-react';
import { auth } from '../lib/firebase';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Check if coupon code is valid
      if (couponCode && couponCode !== 'BCS60') {
        toast({
          title: "Invalid Coupon",
          description: "Please enter a valid coupon code.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      
      // Check if coupon has already been used on this machine
      if (couponCode === 'BCS60') {
        const machineId = await getMachineId();
        const existingCouponData = localStorage.getItem('bcs_coupon');
        
        if (existingCouponData) {
          try {
            const parsed = JSON.parse(existingCouponData);
            // Check if this machine has already used the coupon
            if (parsed.machineId === machineId) {
              const expiryDate = new Date(parsed.expiryDate);
              const currentDate = new Date();
              
              // If the coupon is still valid, don't allow reuse
              if (currentDate < expiryDate) {
                toast({
                  title: "Coupon Already Used",
                  description: "This coupon has already been used on this device.",
                  variant: "destructive",
                });
                setLoading(false);
                return;
              }
            }
          } catch (error) {
            console.error('Error parsing existing coupon data:', error);
          }
        }
      }
      
      await signUp(email, password);
      
      // If coupon code is valid, store it in localStorage
      if (couponCode === 'BCS60') {
        // Store coupon usage with machine identifier
        const machineId = await getMachineId();
        const couponData = {
          code: couponCode,
          userId: email,
          machineId: machineId,
          expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days from now
        };
        localStorage.setItem('bcs_coupon', JSON.stringify(couponData));
      }
      
      toast({
        title: "Success",
        description: "Account created successfully. You are now logged in.",
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create account.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      
      // For Google signup, we'll set a default 60-day trial
      const user = auth.currentUser;
      if (user) {
        const couponData = {
          code: 'GOOGLE_SIGNUP',
          userId: user.email,
          machineId: await getMachineId(),
          expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days from now
        };
        localStorage.setItem('bcs_coupon', JSON.stringify(couponData));
      }
      
      toast({
        title: "Success",
        description: "Account created with Google successfully.",
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create account with Google.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate a machine identifier based on browser fingerprint
  const getMachineId = async (): Promise<string> => {
    // Create a fingerprint based on browser characteristics
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      !!navigator.cookieEnabled,
      !!navigator.onLine
    ].join('|');
    
    // Simple hash function for fingerprint
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2">
            <Button 
              onClick={() => navigate('/')} 
              variant="ghost" 
              size="sm"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground p-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </div>
          <CardTitle>Sign Up</CardTitle>
          <CardDescription>Create a new account to get started</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="couponCode">Coupon Code (Optional)</Label>
              <Input
                id="couponCode"
                type="text"
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              />
              <p className="text-sm text-muted-foreground">Use code BCS60 for 60 days free</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
            
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
            
            <Button 
              type="button" 
              variant="outline" 
              className="w-full" 
              onClick={handleGoogleSignup}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign up with Google
            </Button>
            
            <div className="text-sm text-center">
              Already have an account?{' '}
              <button
                type="button"
                className="text-blue-600 hover:underline"
                onClick={() => navigate('/login')}
              >
                Log in
              </button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Signup;