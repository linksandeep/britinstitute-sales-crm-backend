import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import { generateToken } from '../middleware/auth';
import type { LoginInput, CreateUserInput } from '../types';

const isValidOptionalPhone = (phone: unknown) =>
  phone === undefined ||
  phone === null ||
  (typeof phone === 'string' && (phone.trim() === '' || /^[\+]?[\d\s\-\(\)\.]{7,25}$/.test(phone.trim())));

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginInput = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required',
        errors: ['Please provide both email and password']
      });
      return;
    }

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        errors: ['Email or password is incorrect']
      });
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Account is deactivated',
        errors: ['Please contact administrator to activate your account']
      });
      return;
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        errors: ['Email or password is incorrect']
      });
      return;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken({
      userId: (user._id as string).toString(),
      email: user.email,
      role: user.role
    });

    // Remove password from response
    const userResponse = user.toJSON();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role = 'user' }: CreateUserInput = req.body;

    // Validate input
    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'All fields are required',
        errors: ['Please provide name, email, and password']
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        message: 'Invalid email format',
        errors: ['Please provide a valid email address']
      });
      return;
    }

    // Validate password strength
    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Password too weak',
        errors: ['Password must be at least 6 characters long']
      });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'User already exists',
        errors: ['An account with this email already exists']
      });
      return;
    }

    // Create new user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role
    });

    await user.save();

    // Generate JWT token
    const token = generateToken({
      userId: (user._id as string).toString(),
      email: user.email,
      role: user.role
    });

    // Remove password from response
    const userResponse = user.toJSON();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle specific MongoDB errors
    if (error instanceof Error && error.message.includes('E11000')) {
      res.status(400).json({
        success: false,
        message: 'User already exists',
        errors: ['An account with this email already exists']
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Registration failed',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully',
      data: user
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user profile',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const { name, phone } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // --- 1. Update Name (Optional) ---
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        res.status(400).json({
          success: false,
          message: 'Invalid name',
          errors: ['Name must be at least 2 characters long']
        });
        return;
      }
      user.name = name.trim();
    }

    // --- 2. Update Phone (Optional) ---
    if (phone !== undefined) {
      if (!isValidOptionalPhone(phone)) {
        res.status(400).json({
          success: false,
          message: 'Invalid phone number',
          errors: ['Phone number must be a valid international number']
        });
        return;
      }
      user.phone = phone.trim() || undefined;
    }

    // --- 3. Save Changes ---
    await user.save();

    // --- 4. Handle Response & Fix TS(2590) ---
    // Convert to plain object and cast to 'any' to bypass complex union types
    const userResponse = user.toObject() as any;
    
    // Security: Remove sensitive fields before sending to client
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: userResponse
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'All fields are required',
        errors: ['Please provide current and new password']
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Password too weak',
        errors: ['New password must be at least 6 characters long']
      });
      return;
    }

    const user = await User.findById(req.user.userId).select('+password');
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      res.status(400).json({
        success: false,
        message: 'Invalid current password',
        errors: ['Current password is incorrect']
      });
      return;
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    });
  }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  try {
    // In a stateless JWT setup, logout is handled client-side by removing the token
    // However, we can track logout on the server for analytics or audit purposes
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    });
  }
};

export const dangerReset = async (req: Request, res: Response): Promise<void> => {
  try {
    // Only admins can perform danger reset
    if (req.user?.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    const currentUserId = req.user.userId;
    const currentUserEmail = req.user.email;

    // Get current user and system user
    const currentUser = await User.findById(currentUserId);
    const systemUser = await User.findOne({ email: 'system@leadmanager.com' });

    if (!currentUser) {
      res.status(404).json({
        success: false,
        message: 'Current user not found'
      });
      return;
    }

    // Get Lead model
    const Lead = mongoose.model('Lead');

    // Drop the leads collection
    await Lead.deleteMany({});
    console.log('✅ All leads deleted');

    // Delete all users except current user and system user
    const usersToKeep = [currentUserId];
    if (systemUser) {
      usersToKeep.push((systemUser._id as string).toString());
    }

    const deleteResult = await User.deleteMany({
      _id: { $nin: usersToKeep }
    });

    console.log(`✅ ${deleteResult.deletedCount} users deleted (kept current user: ${currentUserEmail})`);

    res.status(200).json({
      success: true,
      message: `System reset completed successfully. Deleted all leads and ${deleteResult.deletedCount} users (kept current user).`,
      data: {
        leadsDeleted: 'all',
        usersDeleted: deleteResult.deletedCount,
        usersKept: usersToKeep.length
      }
    });

  } catch (error) {
    console.error('Danger reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform danger reset',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    });
  }
};
