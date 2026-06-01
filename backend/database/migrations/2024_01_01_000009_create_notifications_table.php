<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('appointment_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('appointment_id')->constrained()->cascadeOnDelete();
            $table->enum('channel', ['sms', 'email', 'whatsapp'])->default('sms');
            $table->enum('type', ['confirmation', 'reminder', 'cancellation', 'reschedule'])->default('confirmation');
            $table->enum('status', ['pending', 'sent', 'failed'])->default('pending');
            $table->string('recipient');
            $table->text('message');
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
        });

    }

    public function down(): void
    {
        Schema::dropIfExists('appointment_notifications');
    }
};
