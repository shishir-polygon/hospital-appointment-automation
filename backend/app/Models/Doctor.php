<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Carbon\Carbon;

class Doctor extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id', 'department_id', 'name', 'title', 'email', 'phone',
        'qualifications', 'specializations', 'bio', 'photo',
        'consultation_fee', 'avg_consultation_minutes', 'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'consultation_fee' => 'decimal:2',
    ];

    public function hospital(): BelongsTo
    {
        return $this->belongsTo(Hospital::class);
    }

    // All hospitals this doctor works at (via pivot)
    public function hospitals(): BelongsToMany
    {
        return $this->belongsToMany(Hospital::class, 'doctor_hospitals')
            ->withPivot(['department_id', 'consultation_fee', 'is_active'])
            ->withTimestamps();
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(DoctorSchedule::class);
    }

    public function holidays(): HasMany
    {
        return $this->hasMany(DoctorHoliday::class);
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }

    public function getFullNameAttribute(): string
    {
        return "{$this->title} {$this->name}";
    }

    public function todayQueue(): array
    {
        $today = Carbon::today();
        $served = $this->appointments()
            ->whereDate('appointment_date', $today)
            ->whereIn('status', ['completed', 'in_progress'])
            ->max('serial_number') ?? 0;

        $waiting = $this->appointments()
            ->whereDate('appointment_date', $today)
            ->where('status', 'scheduled')
            ->count();

        $inProgress = $this->appointments()
            ->whereDate('appointment_date', $today)
            ->where('status', 'in_progress')
            ->first();

        return [
            'current_serial' => $served,
            'waiting_count' => $waiting,
            'estimated_wait_minutes' => $waiting * $this->avg_consultation_minutes,
            'in_progress_serial' => $inProgress?->serial_number,
            'doctor_available' => $this->isAvailableToday(),
        ];
    }

    public function isAvailableToday(): bool
    {
        $dayOfWeek = Carbon::today()->dayOfWeek;
        $isHoliday = $this->holidays()
            ->whereDate('holiday_date', Carbon::today())
            ->exists();

        if ($isHoliday) {
            return false;
        }

        return $this->schedules()
            ->where('day_of_week', $dayOfWeek)
            ->where('is_active', true)
            ->exists();
    }

    public function nextAvailableSerial(string $date): int
    {
        $last = $this->appointments()
            ->whereDate('appointment_date', $date)
            ->max('serial_number') ?? 0;

        return $last + 1;
    }
}
