<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('doctor_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('doctor_id')->constrained()->cascadeOnDelete();
            $table->tinyInteger('day_of_week'); // 0=Sunday … 6=Saturday
            $table->time('start_time');
            $table->time('end_time');
            $table->integer('max_patients')->default(30);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['doctor_id', 'day_of_week', 'is_active']);
        });

        Schema::create('doctor_holidays', function (Blueprint $table) {
            $table->id();
            $table->foreignId('doctor_id')->constrained()->cascadeOnDelete();
            $table->date('holiday_date');
            $table->string('reason')->nullable();
            $table->timestamps();

            $table->unique(['doctor_id', 'holiday_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('doctor_holidays');
        Schema::dropIfExists('doctor_schedules');
    }
};
