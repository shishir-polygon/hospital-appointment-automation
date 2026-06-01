<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppointmentNotification extends Model
{
    protected $fillable = ['appointment_id', 'channel', 'type', 'status', 'recipient', 'message', 'error_message', 'sent_at'];
    protected $casts = ['sent_at' => 'datetime'];

    public function appointment(): BelongsTo { return $this->belongsTo(Appointment::class); }
}
