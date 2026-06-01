<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->cascadeOnDelete();
            $table->foreignId('doctor_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->string('appointment_ref')->unique();
            $table->integer('serial_number');
            $table->date('appointment_date');
            $table->time('appointment_time')->nullable();
            $table->enum('status', ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'])
                ->default('scheduled');
            $table->enum('booking_channel', ['ai_voice', 'manual', 'web', 'app'])->default('ai_voice');
            $table->string('call_sid')->nullable()->index();
            $table->text('notes')->nullable();
            $table->decimal('fee_charged', 10, 2)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['hospital_id', 'appointment_date', 'status']);
            $table->index(['doctor_id', 'appointment_date']);
            $table->unique(['doctor_id', 'appointment_date', 'serial_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointments');
    }
};
