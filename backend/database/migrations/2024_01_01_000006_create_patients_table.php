<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('patients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('phone')->index();
            $table->string('email')->nullable();
            $table->integer('age')->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->string('national_id')->nullable();
            $table->string('patient_ref')->nullable();
            $table->text('address')->nullable();
            $table->timestamps();

            $table->unique(['hospital_id', 'phone']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patients');
    }
};
