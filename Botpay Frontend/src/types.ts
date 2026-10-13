export type ServiceCategory = 'API' | 'Compute' | 'Data';

export type PaymentRequest = {
  requesterAgent: string;
  providerAgent: string;
  serviceCategory: ServiceCategory;
  serviceDescription: string;
  amount: string;
  token: string;
  deadline: string;
  verificationRequirements: string;
  deliveryReference: string;
  paymentConditions: string;
};

export type StageStatus = 'waiting' | 'active' | 'complete';
