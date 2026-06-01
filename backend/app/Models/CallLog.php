<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CallLog extends Model
{
    protected $fillable = [
        'hospital_id', 'appointment_id', 'call_sid', 'caller_number', 'called_number',
        'status', 'outcome', 'duration_seconds', 'language', 'recording_url',
    ];

    public function hospital(): BelongsTo
    {
        return $this->belongsTo(Hospital::class);
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    public function transcripts(): HasMany
    {
        return $this->hasMany(CallTranscript::class);
    }
}
