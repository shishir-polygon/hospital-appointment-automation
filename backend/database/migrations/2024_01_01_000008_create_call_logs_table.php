<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('call_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('appointment_id')->nullable()->constrained()->nullOnDelete();
            $table->string('call_sid')->unique();
            $table->string('caller_number');
            $table->string('called_number')->nullable();
            $table->enum('status', ['initiated', 'ringing', 'in_progress', 'completed', 'failed', 'busy', 'no_answer'])
                ->default('initiated');
            $table->enum('outcome', ['appointment_booked', 'info_provided', 'cancelled', 'rescheduled', 'incomplete', 'error'])
                ->nullable();
            $table->integer('duration_seconds')->nullable();
            $table->string('language', 5)->default('en');
            $table->string('recording_url')->nullable();
            $table->timestamps();

            $table->index(['hospital_id', 'created_at']);
        });

        Schema::create('call_transcripts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('call_log_id')->constrained()->cascadeOnDelete();
            $table->enum('role', ['user', 'assistant']);
            $table->text('content');
            $table->integer('turn_number')->default(0);
            $table->timestamps();

            $table->index('call_log_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('call_transcripts');
        Schema::dropIfExists('call_logs');
    }
};
