<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('doctor_hospitals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('doctor_id')->constrained()->cascadeOnDelete();
            $table->foreignId('hospital_id')->constrained()->cascadeOnDelete();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('consultation_fee', 10, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['doctor_id', 'hospital_id']);
        });

        // Pivot data is seeded by HospitalSeeder, not here,
        // because migrations run before seeders (doctors table is empty at migration time).
    }

    public function down(): void
    {
        Schema::dropIfExists('doctor_hospitals');
    }
};
