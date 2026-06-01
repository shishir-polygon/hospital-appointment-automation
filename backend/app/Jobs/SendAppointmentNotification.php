<?php

namespace App\Jobs;

use App\Models\Appointment;
use App\Models\AppointmentNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendAppointmentNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    public function __construct(
        private readonly int $appointmentId,
        private readonly string $type = 'confirmation'
    ) {}

    public function handle(): void
    {
        $appointment = Appointment::with(['doctor', 'patient', 'hospital'])->find($this->appointmentId);
        if (!$appointment) return;

        $patient = $appointment->patient;
        $doctor = $appointment->doctor;
        $hospital = $appointment->hospital;

        $message = $this->buildMessage($appointment);

        // Send Email (free via SMTP)
        if ($patient->email) {
            $this->sendEmail($patient->email, $appointment, $message);
        }

        // Record notification
        AppointmentNotification::create([
            'appointment_id' => $appointment->id,
            'channel' => 'email',
            'type' => $this->type,
            'status' => 'sent',
            'recipient' => $patient->email ?? $patient->phone,
            'message' => $message,
            'sent_at' => now(),
        ]);

        Log::info('Appointment notification sent', [
            'appointment_id' => $appointment->id,
            'type' => $this->type,
        ]);
    }

    private function buildMessage(Appointment $appointment): string
    {
        return "Appointment Confirmed!\n"
            . "Patient: {$appointment->patient->name}\n"
            . "Doctor: {$appointment->doctor->full_name}\n"
            . "Date: {$appointment->appointment_date->format('D, M j Y')}\n"
            . "Serial #: {$appointment->serial_number}\n"
            . "Hospital: {$appointment->hospital->name}\n"
            . "Ref: {$appointment->appointment_ref}";
    }

    private function sendEmail(string $email, Appointment $appointment, string $message): void
    {
        try {
            Mail::raw($message, function ($mail) use ($email, $appointment) {
                $mail->to($email)
                    ->subject("Appointment Confirmed — {$appointment->appointment->doctor->full_name ?? 'Doctor'} — Serial #{$appointment->serial_number}");
            });
        } catch (\Throwable $e) {
            Log::warning('Email notification failed', ['error' => $e->getMessage()]);
        }
    }
}
