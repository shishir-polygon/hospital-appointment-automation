<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Appointment extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id', 'doctor_id', 'patient_id', 'appointment_ref',
        'serial_number', 'appointment_date', 'appointment_time',
        'status', 'booking_channel', 'call_sid', 'notes', 'fee_charged', 'created_by',
    ];

    protected $casts = [
        'appointment_date' => 'date',
        'fee_charged' => 'decimal:2',
    ];

    protected static function boot(): void
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->appointment_ref)) {
                $model->appointment_ref = 'APT-' . strtoupper(Str::random(8));
            }
        });
    }

    public function hospital(): BelongsTo
    {
        return $this->belongsTo(Hospital::class);
    }

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(Doctor::class);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(AppointmentNotification::class);
    }

    public function callLog(): BelongsTo
    {
        return $this->belongsTo(CallLog::class, 'call_sid', 'call_sid');
    }
}
