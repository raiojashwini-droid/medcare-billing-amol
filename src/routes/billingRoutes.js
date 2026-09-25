import express from 'express';
import { 
  getFourBillsByCase, getBillById, createBill, addServiceLine, 
  postPayment, postAdjustment, finaliseBill, getAgingSummary,
  getOverviewStats, getPaymentsList, getPracticeReports, updateBill, deleteBill,
  getAllCmsClaims
} from '../controllers/billingController.js';

const router = express.Router();

// Register paths
router.get('/cms-claims', getAllCmsClaims);
router.get('/overview-stats', getOverviewStats);
router.get('/transactions', getPaymentsList);
router.get('/reports', getPracticeReports);
router.get('/cases/bills', getFourBillsByCase); // Matches mock call getFourBillsByCase
router.get('/four-bills', getFourBillsByCase);
router.get('/case-bills', getFourBillsByCase);
router.get('/aging', getAgingSummary);
router.get('/bills/:id', getBillById);
router.post('/bills', createBill);
router.put('/bills/:id', updateBill);
router.delete('/bills/:id', deleteBill);
router.post('/bills/:id/service-lines', addServiceLine); // Matches addServiceLine form submit
router.post('/bills/:id/payments', postPayment);
router.post('/bills/:id/adjustments', postAdjustment);
router.post('/bills/:id/finalise', finaliseBill);

export default router;
