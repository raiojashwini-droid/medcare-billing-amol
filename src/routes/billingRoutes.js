import express from 'express';
import { 
  getFourBillsByCase, getBillById, createBill, addServiceLine, 
  postPayment, postAdjustment, finaliseBill, getAgingSummary,
  getOverviewStats, getPaymentsList, getPracticeReports, updateBill, deleteBill,
  getAllCmsClaims,
  getCounselingVisitsForPatient, recordCounselingVisit, syncCounselingBill, removeCounselingVisitFromBill,
  deleteServiceLine
} from '../controllers/billingController.js';

const router = express.Router();

// Counseling Visit Billing Endpoints (Manual visit tracking & billing)
router.get('/counseling-visits/:patientId', getCounselingVisitsForPatient);
router.post('/counseling-visits', recordCounselingVisit);
router.post('/counseling-visits/sync-bill', syncCounselingBill);
router.delete('/counseling-visits/service-line/:lineId', removeCounselingVisitFromBill);

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
router.delete('/bills/:id/service-lines/:lineId', deleteServiceLine); // Delete individual CPT line
router.post('/bills/:id/payments', postPayment);
router.post('/bills/:id/adjustments', postAdjustment);
router.post('/bills/:id/finalise', finaliseBill);

export default router;
