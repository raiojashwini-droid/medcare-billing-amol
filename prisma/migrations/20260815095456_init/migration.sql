-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(50) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `name` VARCHAR(100) NULL,
    `full_name` VARCHAR(100) NULL,
    `role` VARCHAR(50) NOT NULL,
    `title` VARCHAR(100) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    `avatar` VARCHAR(255) NULL,
    `mfa_secret` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `providers` (
    `id` VARCHAR(50) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `business_name` VARCHAR(200) NOT NULL,
    `service_category` VARCHAR(100) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    `is_placeholder` BOOLEAN NOT NULL DEFAULT false,
    `address` JSON NULL,
    `contact` JSON NULL,
    `identifiers` JSON NULL,
    `rendering_provider` JSON NULL,
    `service_facility` JSON NULL,
    `billing_provider` JSON NULL,
    `default_place_of_service` VARCHAR(10) NULL,
    `available_services` JSON NULL,
    `available_diagnoses` JSON NULL,
    `provider_services` JSON NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `patients` (
    `id` VARCHAR(50) NOT NULL,
    `patient_id_mrn` VARCHAR(50) NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `middle_name` VARCHAR(100) NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `dob` VARCHAR(20) NULL,
    `dob_date` DATE NULL,
    `sex` VARCHAR(10) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(150) NULL,
    `ssn` VARCHAR(50) NULL,
    `street` VARCHAR(200) NULL,
    `suite` VARCHAR(50) NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(10) NULL,
    `zip_code` VARCHAR(20) NULL,
    `communication_pref` VARCHAR(50) NULL,
    `consent_status` VARCHAR(50) NULL,
    `assigned_provider_ids` JSON NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    `created_at_str` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `patients_last_name_idx`(`last_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cases` (
    `id` VARCHAR(50) NOT NULL,
    `case_id_str` VARCHAR(50) NULL,
    `patient_id` VARCHAR(50) NOT NULL,
    `accident_date_str` VARCHAR(20) NULL,
    `accident_date` DATE NULL,
    `initial_date_str` VARCHAR(20) NULL,
    `initial_date` DATE NULL,
    `discharge_date_str` VARCHAR(20) NULL,
    `discharge_date` DATE NULL,
    `accident_type` VARCHAR(100) NOT NULL,
    `accident_state` VARCHAR(10) NOT NULL,
    `accident_city` VARCHAR(100) NULL,
    `accident_location` VARCHAR(255) NULL,
    `mechanism_of_injury` VARCHAR(255) NULL,
    `police_report_number` VARCHAR(100) NULL,
    `emergency_transport` VARCHAR(50) NULL,
    `chief_complaint` TEXT NULL,
    `injury_body_parts` VARCHAR(255) NULL,
    `diagnosis_codes` JSON NULL,
    `referring_provider_name` VARCHAR(100) NULL,
    `referring_provider_npi` VARCHAR(50) NULL,
    `attorney_name` VARCHAR(150) NULL,
    `law_firm` VARCHAR(150) NULL,
    `attorney_address` VARCHAR(255) NULL,
    `attorney_phone` VARCHAR(20) NULL,
    `attorney_email` VARCHAR(150) NULL,
    `law_firm_address` VARCHAR(255) NULL,
    `litigation_status` VARCHAR(50) NULL,
    `insurance_company` VARCHAR(150) NULL,
    `insurance_policy_number` VARCHAR(100) NULL,
    `insurance_claim_number` VARCHAR(100) NULL,
    `insurance_adjuster` VARCHAR(100) NULL,
    `insurance_adjuster_phone` VARCHAR(20) NULL,
    `liability_status` VARCHAR(50) NULL,
    `case_notes` TEXT NULL,
    `assigned_provider_ids` JSON NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cases_patient_id_idx`(`patient_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appointments` (
    `id` VARCHAR(50) NOT NULL,
    `patient_id` VARCHAR(50) NOT NULL,
    `case_id` VARCHAR(50) NULL,
    `provider_id` VARCHAR(50) NOT NULL,
    `date` VARCHAR(20) NULL,
    `appointment_date` DATE NULL,
    `start_time` VARCHAR(20) NOT NULL,
    `end_time` VARCHAR(20) NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    `booking_ref` VARCHAR(50) NULL,
    `booking_channel` VARCHAR(100) NULL,
    `reminder_status` VARCHAR(100) NULL,
    `reminder_preference` VARCHAR(50) NULL,
    `reason_for_visit` TEXT NULL,
    `appointment_type` VARCHAR(100) NULL,
    `cpt_code` VARCHAR(10) NULL,
    `location` VARCHAR(150) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `appointments_patient_id_idx`(`patient_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clinical_notes` (
    `id` VARCHAR(50) NOT NULL,
    `patient_id` VARCHAR(50) NOT NULL,
    `case_id` VARCHAR(50) NOT NULL,
    `provider_id` VARCHAR(50) NOT NULL,
    `note_type` VARCHAR(50) NOT NULL,
    `title` VARCHAR(150) NULL,
    `date` VARCHAR(20) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'UNSIGNED',
    `author` VARCHAR(100) NULL,
    `signed_by` VARCHAR(100) NULL,
    `signed_at` DATETIME(3) NULL,
    `signature_url` VARCHAR(255) NULL,
    `soap_subjective` TEXT NULL,
    `soap_objective` TEXT NULL,
    `soap_assessment` TEXT NULL,
    `soap_plan` TEXT NULL,
    `anatomical_diagram_data` TEXT NULL,
    `content` JSON NULL,
    `addendums` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `clinical_notes_case_id_status_idx`(`case_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bills` (
    `id` VARCHAR(50) NOT NULL,
    `case_id` VARCHAR(50) NOT NULL,
    `provider_id` VARCHAR(50) NOT NULL,
    `invoice_number` VARCHAR(50) NOT NULL,
    `statement_number` VARCHAR(50) NULL,
    `statement_date` VARCHAR(50) NULL,
    `bill_to_name` VARCHAR(150) NULL,
    `bill_to_address` VARCHAR(255) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'UNBILLED',
    `totals` JSON NULL,
    `aging` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `bills_invoice_number_key`(`invoice_number`),
    INDEX `bills_case_id_idx`(`case_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_lines` (
    `id` VARCHAR(50) NOT NULL,
    `bill_id` VARCHAR(50) NOT NULL,
    `dos` VARCHAR(20) NULL,
    `date_of_service` VARCHAR(20) NULL,
    `place_of_service` VARCHAR(10) NOT NULL DEFAULT '11',
    `cpt_code` VARCHAR(10) NOT NULL,
    `description` VARCHAR(150) NULL,
    `modifier_1` VARCHAR(5) NULL,
    `modifier_2` VARCHAR(5) NULL,
    `modifier_3` VARCHAR(5) NULL,
    `modifier_4` VARCHAR(5) NULL,
    `diag_pointer` VARCHAR(20) NULL,
    `diagnosis_pointer` VARCHAR(20) NULL,
    `units` INTEGER NOT NULL DEFAULT 1,
    `charge` DECIMAL(10, 2) NOT NULL,
    `payments` JSON NULL,
    `insurance_payment` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `patient_payment` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `other_payment` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `adjustment` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `adjustments` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `balance` DECIMAL(10, 2) NOT NULL,
    `line_balance` DECIMAL(10, 2) NOT NULL,

    INDEX `service_lines_bill_id_idx`(`bill_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` VARCHAR(50) NOT NULL,
    `bill_id` VARCHAR(50) NOT NULL,
    `transaction_type` VARCHAR(50) NOT NULL,
    `source` VARCHAR(50) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `reference_number` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documents` (
    `id` VARCHAR(50) NOT NULL,
    `case_id` VARCHAR(50) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `type` VARCHAR(100) NULL,
    `document_type` VARCHAR(100) NOT NULL,
    `provider_name` VARCHAR(150) NULL,
    `date` VARCHAR(20) NULL,
    `status` VARCHAR(50) NOT NULL,
    `size` VARCHAR(50) NULL,
    `url` VARCHAR(255) NOT NULL DEFAULT '',
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(50) NOT NULL,
    `user_id` VARCHAR(100) NULL,
    `user_name` VARCHAR(100) NULL,
    `user` VARCHAR(100) NULL,
    `role` VARCHAR(50) NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `resource` VARCHAR(250) NULL,
    `patient_id` VARCHAR(50) NULL,
    `ip_address` VARCHAR(45) NULL,
    `details` TEXT NULL,
    `timestamp` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reminder_settings` (
    `id` VARCHAR(50) NOT NULL DEFAULT 'default',
    `enable_24h_sms` BOOLEAN NOT NULL DEFAULT true,
    `enable_2h_email` BOOLEAN NOT NULL DEFAULT true,
    `enable_missed_follow_up` BOOLEAN NOT NULL DEFAULT true,
    `sms_template` TEXT NOT NULL,
    `email_template` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reminder_logs` (
    `id` VARCHAR(50) NOT NULL,
    `patient_name` VARCHAR(150) NOT NULL,
    `channel` VARCHAR(50) NOT NULL,
    `sent_at` VARCHAR(30) NOT NULL,
    `recipient` VARCHAR(150) NOT NULL,
    `status` VARCHAR(100) NOT NULL,
    `message_preview` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cases` ADD CONSTRAINT `cases_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_case_id_fkey` FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clinical_notes` ADD CONSTRAINT `clinical_notes_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clinical_notes` ADD CONSTRAINT `clinical_notes_case_id_fkey` FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clinical_notes` ADD CONSTRAINT `clinical_notes_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bills` ADD CONSTRAINT `bills_case_id_fkey` FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bills` ADD CONSTRAINT `bills_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_lines` ADD CONSTRAINT `service_lines_bill_id_fkey` FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_bill_id_fkey` FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_case_id_fkey` FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
