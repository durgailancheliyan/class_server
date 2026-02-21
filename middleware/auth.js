import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized' });
  }
};

export const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

export const trainerOrAdmin = (req, res, next) => {
  if (!['admin', 'trainer'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Trainer or admin access required' });
  }
  next();
};

export const trainerOnly = (req, res, next) => {
  if (req.user?.role !== 'trainer') {
    return res.status(403).json({ message: 'Only trainers can create attendance links' });
  }
  next();
};
