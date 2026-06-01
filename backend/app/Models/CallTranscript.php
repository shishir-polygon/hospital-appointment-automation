<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CallTranscript extends Model
{
    protected $fillable = ['call_log_id', 'role', 'content', 'turn_number'];

    public function callLog(): BelongsTo { return $this->belongsTo(CallLog::class); }
}
